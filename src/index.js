const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function encodeBase62(num) {
  let str = "";
  while (num > 0) {
    str = BASE62[num % 62] + str;
    num = Math.floor(num / 62);
  }
  return str || "0";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // CREATE SHORT LINK
    if (request.method === "POST" && url.pathname === "/shorten") {

      const data = await request.json();
      const original = data.url;
      const alias = data.alias;

      if (!original) {
        return json({ error: "Missing URL" }, 400);
      }

      let id;

      // CUSTOM ALIAS
      if (alias) {

        const exists = await env.URL_STORE.get(alias);

        if (exists) {
          return json({ error: "Alias already exists" }, 400);
        }

        id = alias;

      } else {

        // increment counter
        let counter = await env.URL_STORE.get("counter");

        counter = counter ? parseInt(counter) + 1 : 1;

        await env.URL_STORE.put("counter", String(counter));

        id = encodeBase62(counter);
      }

      await env.URL_STORE.put(id, original);

      return json({
        short: `${url.origin}/${id}`
      });
    }

    // REDIRECT
    const id = url.pathname.slice(1);

    if (id) {

      const original = await env.URL_STORE.get(id);

      if (!original) {
        return new Response("Not Found", {
          status: 404,
          headers: corsHeaders
        });
      }

      return new Response(null, {
        status: 302,
        headers: {
          "Location": original,
          ...corsHeaders
        }
      });
    }

    return new Response("URL Shortener Running", {
      headers: corsHeaders
    });
  }
};