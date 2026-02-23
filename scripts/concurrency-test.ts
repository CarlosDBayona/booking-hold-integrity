type HoldPayload = {
  skuId: string;
  userId: string;
  cartId: string;
};

async function run(): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const skuId = process.env.SKU_ID ?? "SKU-CONCURRENCY-1";
  const attempts = Number(process.env.ATTEMPTS ?? "50");

  const requests = Array.from({ length: attempts }, (_v, index) => {
    const payload: HoldPayload = {
      skuId,
      userId: `user-${index + 1}`,
      cartId: `cart-${index + 1}`,
    };

    return fetch(`${baseUrl}/reservations/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => ({
      status: response.status,
      body: await response.json().catch(() => ({})),
    }));
  });

  const results = await Promise.all(requests);

  const created = results.filter((r) => r.status === 201).length;
  const locked = results.filter((r) => r.status === 409 && r.body.reason === "SKU_LOCKED").length;
  const others = results.filter((r) => r.status !== 201 && !(r.status === 409 && r.body.reason === "SKU_LOCKED")).length;

  console.log(JSON.stringify({ attempts, created, locked, others }, null, 2));

  if (created !== 1 || locked !== attempts - 1 || others !== 0) {
    console.error("Concurrency expectation failed");
    process.exit(1);
  }

  console.log("Concurrency expectation passed: exactly one hold created and all others rejected.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
