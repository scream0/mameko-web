import test from 'node:test';
import assert from 'node:assert/strict';
import { sortOrdersByNewestFirst } from './orderSorting.ts';

test('sortOrdersByNewestFirst puts the most recent order first', () => {
  const orders = [
    { id: 'old', createdAt: '2024-01-10T10:00:00.000Z' },
    { id: 'newer', createdAt: '2024-02-20T10:00:00.000Z' },
    { id: 'newest', createdAt: '2024-03-05T10:00:00.000Z' },
  ];

  const sorted = sortOrdersByNewestFirst(orders as any);

  assert.deepEqual(sorted.map((order: any) => order.id), ['newest', 'newer', 'old']);
});
