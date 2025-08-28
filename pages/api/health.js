export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    // Health check endpoint - supports GET requests
    if (req.method === 'GET') {
      const healthData = {
        status: 'healthy',
        timestamp: Date.now(),
        edge: {
          region: req.geo?.region || 'Unknown',
          country: req.geo?.country || 'Unknown',
        },
        performance: {
          responseTime: Date.now(), // Will be calculated on client side
        },
        version: '0.6.0',
        environment: 'production'
      };

      return new Response(JSON.stringify(healthData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Edge-Region': req.geo?.region || 'unknown',
        },
      });
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health check error:', error);

    return new Response(JSON.stringify({
      status: 'error',
      error: 'Health check failed',
      timestamp: Date.now()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
