export async function decodeSvelteData(
    json: { nodes: { type: string; data: unknown[] }[] },
    nodeIndex: number = 0,
): Promise<unknown> {
    const { unflatten } =
        typeof window !== "undefined"
            ? await import("https://esm.sh/devalue")
            : await import("devalue");

    const nodes = json.nodes.filter(
        (n) => n.type === "data" && Array.isArray(n.data),
    );
    const node = nodes[nodeIndex];
    if (!node) return null;

    return unflatten(node.data as unknown[]);
}
