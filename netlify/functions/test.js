export async function handler(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Netlify function is working!",
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      environment: "production"
    })
  };
}
