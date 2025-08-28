import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get request data
    let requestData = {};
    try {
      requestData = await req.json();
    } catch (e) {
      // If no JSON body, that's okay for analytics
    }

    // Collect analytics data
    const analytics = {
      timestamp: Date.now(),
      userAgent: req.headers.get('user-agent'),
      country: req.geo?.country || 'Unknown',
      city: req.geo?.city || 'Unknown',
      region: req.geo?.region || 'Unknown',
      performance: {
        connectionType: req.headers.get('connection-type'),
        deviceMemory: req.headers.get('device-memory'),
        effectiveType: req.headers.get('ect'), // Effective Connection Type
      },
      referer: req.headers.get('referer'),
      acceptLanguage: req.headers.get('accept-language'),
      // Include any custom data from the request
      customData: requestData
    };

    // In a real implementation, you might want to store this data
    // For now, we'll just return it for debugging purposes
    console.log('Analytics data collected:', analytics);

    return new Response(JSON.stringify({
      success: true,
      analytics,
      message: 'Analytics data collected successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Analytics error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to process analytics data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
