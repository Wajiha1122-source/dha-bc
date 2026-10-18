try {
  const responses = await Promise.all([
    fetch('http://localhost:5173', { signal: AbortSignal.timeout(2500) }),
    fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5000) }),
  ]);
  const html = await responses[0].text();
  process.exit(responses.every(response => response.ok) && html.includes('DHA Multan') ? 0 : 1);
} catch {
  process.exit(1);
}
