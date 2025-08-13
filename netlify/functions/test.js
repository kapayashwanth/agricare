export async function handler(event) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Netlify function is working!",
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      environment: process.env.NODE_ENV || "development"
    })
  };
}
