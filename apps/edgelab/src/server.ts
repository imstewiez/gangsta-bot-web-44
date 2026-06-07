export default {
  async fetch(request: Request, env: { ASSETS?: { fetch: (request: Request) => Promise<Response> } }) {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("EdgeLab preview worker is running", { status: 200 });
  },
};
