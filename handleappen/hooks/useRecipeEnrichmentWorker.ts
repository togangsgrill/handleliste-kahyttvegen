import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUIStore } from '@/stores/useUIStore';
import { parseMealPlanIngredients } from '@/lib/claude';

/**
 * Global bakgrunnsjobber: berik oppskrifter som er markert `enrichment_status='pending'`.
 *
 * Mountet én gang på app-root (AppLayout). Overlever navigering mellom skjermer
 * fordi den lever utenfor skjerm-komponentene. Hvis brukeren lukker browseren
 * midt i jobben, fortsetter den ved neste app-start fordi tilstanden er i DB.
 *
 * Flyt:
 *  1. Ved mount: reset 'loading'-oppskrifter som har hengt >5 min (crash recovery)
 *  2. Poll `claim_next_enrichment` — atomisk grab av én pending oppskrift
 *  3. Kall Claude via parseMealPlanIngredients
 *  4. Lagre ingredienser + instructions → marker 'done'
 *  5. Ved feil: én retry, så 'failed'
 *  6. Ved success: slett enrichment_job hvis ingen andre recipes refererer til den
 *  7. Gå til 2 til ingen flere pending
 *
 * Kun én worker-instans per app-mount (ref-guard). To faner vil kunne claime
 * hver sin oppskrift parallelt — det er OK og ønsket.
 */
export function useRecipeEnrichmentWorker() {
  const householdId = useAuthStore((s) => s.householdId);
  const runningRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    console.log('[enrichment-worker] mount, householdId=', householdId);
    if (!householdId) return;
    stoppedRef.current = false;

    const run = async () => {
      if (runningRef.current) {
        console.log('[enrichment-worker] allerede kjørende, hopper over');
        return;
      }
      runningRef.current = true;
      console.log('[enrichment-worker] starter kjøring for household', householdId);

      try {
        // Crash recovery: frigjør oppskrifter som har vært 'loading' i mer enn 5 min
        const resetResult = await supabase.rpc('reset_stale_enrichments', { p_household_id: householdId });
        console.log('[enrichment-worker] reset_stale_enrichments:', resetResult);

        let iter = 0;
        while (!stoppedRef.current) {
          iter++;
          console.log(`[enrichment-worker] iter ${iter}: kaller claim_next_enrichment`);
          const { data, error } = await supabase.rpc('claim_next_enrichment', {
            p_household_id: householdId,
          });

          if (error) {
            console.error('[enrichment-worker] claim_next_enrichment feil:', error);
            break;
          }
          console.log(`[enrichment-worker] iter ${iter}: data=`, data ? `array(${(data as any[])?.length ?? 0})` : data);
          if (!data || (data as any[]).length === 0) {
            console.log('[enrichment-worker] ingen flere pending, stopper');
            break;
          }

          const job = (data as any[])[0] as {
            recipe_id: string;
            recipe_name: string;
            job_id: string;
            file_base64: string;
            media_type: string;
          };
          console.log(`[enrichment-worker] behandler "${job.recipe_name}" (${job.recipe_id})`);

          await processOne(job);

          // Liten pause mellom kall for å unngå rate-limit
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (e) {
        console.error('[enrichment-worker] uventet feil:', e);
      } finally {
        runningRef.current = false;
        console.log('[enrichment-worker] kjøring ferdig');
      }
    };

    // Start med en gang ved mount
    run();

    // Realtime: trigger ny kjøring når en oppskrift markeres pending
    // (f.eks. rett etter import — worker skal plukke opp umiddelbart)
    const channelName = `enrichment-worker:${householdId}:${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recipes',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.enrichment_status;
          if (newStatus === 'pending') run();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recipes',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.enrichment_status;
          if (newStatus === 'pending') run();
        }
      )
      .subscribe();

    return () => {
      stoppedRef.current = true;
      supabase.removeChannel(channel);
    };
  }, [householdId]);
}

async function processOne(job: {
  recipe_id: string;
  recipe_name: string;
  job_id: string;
  file_base64: string;
  media_type: string;
}) {
  const showToast = useUIStore.getState().showToast;

  const attempt = async () => {
    return await parseMealPlanIngredients(job.file_base64, job.media_type, job.recipe_name);
  };

  try {
    let detail;
    try {
      detail = await attempt();
    } catch (firstErr) {
      console.warn(`[enrichment-worker] første forsøk feilet for "${job.recipe_name}", prøver igjen om 3s:`, firstErr);
      await new Promise((r) => setTimeout(r, 3000));
      detail = await attempt();
    }

    if (detail.ingredients.length > 0) {
      const { error: insertErr } = await supabase.from('recipe_ingredients').insert(
        detail.ingredients.map((ing) => ({
          recipe_id: job.recipe_id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
      );
      if (insertErr) throw new Error(`Kunne ikke lagre ingredienser: ${insertErr.message}`);
    }

    const updates: any = { enrichment_status: 'done', enrichment_error: null };
    if (detail.instructions) updates.instructions = detail.instructions;
    await supabase.from('recipes').update(updates).eq('id', job.recipe_id);

    if (detail.ingredients.length > 0) {
      showToast(`${job.recipe_name} — ${detail.ingredients.length} ingredienser klare`, '🛒');
    } else {
      showToast(`${job.recipe_name} — ingen ingredienser funnet`, '⚠️');
    }

    // Rydd opp: slett enrichment_job hvis ingen andre recipes peker på den
    const { count } = await supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('enrichment_job_id', job.job_id);

    if (!count || count === 0) {
      await supabase.from('enrichment_jobs').delete().eq('id', job.job_id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    console.error(`[enrichment-worker] "${job.recipe_name}" feilet etter retry:`, err);
    await supabase
      .from('recipes')
      .update({ enrichment_status: 'failed', enrichment_error: msg })
      .eq('id', job.recipe_id);
    showToast(`${job.recipe_name} — kunne ikke hente ingredienser`, '❌');
  }
}
