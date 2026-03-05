import { useState } from 'react';

function loadBasket(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function saveBasket(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/**
 * useBasket — persistent basket state for a single entity type.
 *
 * @param {string} storageKey  — localStorage key (e.g. 'orion_instBasket')
 * @param {string} idKey       — primary key field (e.g. 'institution_id')
 * @param {string[]} pickFields — fields to store per item (e.g. ['institution_id','name','country','type'])
 * @returns {{ basket, addToBasket, removeFromBasket }}
 */
export default function useBasket(storageKey, idKey, pickFields) {
  const [basket, setBasketRaw] = useState(() => loadBasket(storageKey));

  const setBasket = val => {
    const next = typeof val === 'function' ? val(basket) : val;
    setBasketRaw(next);
    saveBasket(storageKey, next);
  };

  const addToBasket = row => {
    setBasket(prev => {
      if (prev.find(b => b[idKey] === row[idKey])) return prev;
      const item = Object.fromEntries(pickFields.map(f => [f, row[f] ?? null]));
      return [...prev, item];
    });
  };

  const removeFromBasket = id => {
    setBasket(prev => prev.filter(b => b[idKey] !== id));
  };

  return { basket, addToBasket, removeFromBasket };
}
