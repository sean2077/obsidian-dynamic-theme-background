import assert from "node:assert/strict";
import test from "node:test";

import { DragSort } from "../src/utils/drag-sort";

interface Item {
    id: string;
}

function createSort(items: Item[], onReorder: (reordered: Item[]) => Promise<void> | void): DragSort<Item> {
    return new DragSort<Item>({
        container: {} as HTMLElement,
        items,
        getItemId: (item) => item.id,
        onReorder,
    });
}

void test("accessible reorder moves one position and reports boundaries", async () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const observed: string[][] = [];
    const sort = createSort(items, (reordered) => {
        observed.push(reordered.map((item) => item.id));
    });

    assert.equal(sort.canMove(items[0], -1), false);
    assert.equal(sort.canMove(items[0], 1), true);
    assert.equal(sort.canMove(items[2], 1), false);
    assert.equal(await sort.moveItem(items[1], -1), true);
    assert.deepEqual(
        items.map((item) => item.id),
        ["b", "a", "c"]
    );
    assert.deepEqual(observed, [["b", "a", "c"]]);
    assert.equal(await sort.moveItem(items[0], -1), false);
    assert.equal(observed.length, 1);
});

void test("accessible reorder ignores duplicate actions while persistence is pending", async () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const sort = createSort(items, () => gate);

    const firstMove = sort.moveItem(items[0], 1);
    await Promise.resolve();
    assert.equal(sort.canMove(items[2], -1), false);
    assert.equal(await sort.moveItem(items[2], -1), false);

    release();
    assert.equal(await firstMove, true);
    assert.deepEqual(
        items.map((item) => item.id),
        ["b", "a", "c"]
    );
});

void test("accessible reorder restores its local order when persistence rejects", async () => {
    const items = [{ id: "a" }, { id: "b" }];
    const sort = createSort(items, () => Promise.reject(new Error("save failed")));

    await assert.rejects(sort.moveItem(items[0], 1), /save failed/u);
    assert.deepEqual(
        items.map((item) => item.id),
        ["a", "b"]
    );
    assert.equal(sort.canMove(items[0], 1), true);
});
