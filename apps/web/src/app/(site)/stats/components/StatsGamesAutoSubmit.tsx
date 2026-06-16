"use client";

import { useEffect } from "react";

const AUTO_SUBMIT_FIELDS = new Set(["genre", "subgenre", "sort", "minPlayers", "column"]);

export function StatsGamesAutoSubmit() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("[data-stats-games-form]");
    if (!form) return;

    const submit = () => {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (!AUTO_SUBMIT_FIELDS.has(target.name)) return;
      submit();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-stats-games-reset]")) return;
      for (const input of form.querySelectorAll<HTMLInputElement>('input[name="genre"], input[name="subgenre"]')) {
        input.checked = false;
      }
    };

    form.addEventListener("change", onChange);
    form.addEventListener("click", onClick);
    return () => {
      form.removeEventListener("change", onChange);
      form.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
