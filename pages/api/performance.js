export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    // Only allow POST requests for performance data
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse performance data from request
    let performanceData = {};
    try {
      performanceData = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required performance metrics
    const requiredFields = ['componentName', 'renderTime'];
    const missingFields = requiredFields.filter(field => !performanceData[field]);

    if (missingFields.length > 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        missingFields
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enhance performance data with edge context
    const enhancedData = {
      ...performanceData,
      timestamp: Date.now(),
      geo: {
        country: req.geo?.country || 'Unknown',
        city: req.geo?.city || 'Unknown',
        region: req.geo?.region || 'Unknown',
      },
      connection: {
        type: req.headers.get('connection-type'),
        effectiveType: req.headers.get('ect'),
        downlink: req.headers.get('downlink'),
        rtt: req.headers.get('rtt'),
      },
      device: {
        userAgent: req.headers.get('user-agent'),
        deviceMemory: req.headers.get('device-memory'),
      }
    };

    // Log performance data (in production, you'd send this to your monitoring service)
    console.log('Performance data received:', enhancedData);

    // Check for performance issues and return recommendations
    const recommendations = [];

    if (performanceData.renderTime > 16) {
      recommendations.push('Component render time exceeds 16ms (60fps threshold)');
    }

    if (performanceData.renderTime > 100) {
      recommendations.push('Critical: Component render time exceeds 100ms');
    }

    if (performanceData.memory && performanceData.memory.used > 50) {
      recommendations.push('High memory usage detected (>50MB)');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Performance data processed successfully',
      recommendations,
      processed: {
        componentName: performanceData.componentName,
        renderTime: performanceData.renderTime,
        timestamp: enhancedData.timestamp,
        geo: enhancedData.geo.country
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Performance endpoint error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to process performance data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
