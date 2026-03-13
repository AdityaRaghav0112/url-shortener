const BASE4 = "0123";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// Base4 encoder with fixed length
function encodeBase4(num, length) {
  let str = "";

  while (num > 0) {
    str = BASE4[num % 4] + str;
    num = Math.floor(num / 4);
  }

  str = str || "0";

  return str.padStart(length, "0");
}

// Extract name ONLY if hostname contains "_" or "-"
function extractNameFromURL(originalUrl) {
  try {
    const parsed = new URL(originalUrl);
    let host = parsed.hostname;

    if (host.startsWith("www.")) {
      host = host.slice(4);
    }

    // Only allow names if _ or - exists
    if (!host.includes("_") && !host.includes("-")) {
      return null;
    }

    const firstPart = host.split(/[._-]/)[0];

    return firstPart.slice(0, 8).toLowerCase();
  } catch {
    return null;
  }
}

// JSON helper
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

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // SHORTEN
    if (request.method === "POST" && url.pathname === "/shorten") {

      const data = await request.json();
      const original = data.url;
      const alias = data.alias;

      if (!original) {
        return json({ error: "Missing URL" }, 400);
      }

      let id;

      // Custom alias
      if (alias) {

        const exists = await env.URL_STORE.get(alias);

        if (exists) {
          return json({ error: "Alias already exists" }, 400);
        }

        id = alias;

      } else {

        let counter = await env.URL_STORE.get("counter");
        counter = counter ? parseInt(counter) + 1 : 1;

        await env.URL_STORE.put("counter", String(counter));

        const extracted = extractNameFromURL(original);

        // If URL has name pattern
        if (extracted) {
          id = extracted + encodeBase4(counter, 2);
        }
        // Otherwise digits only
        else {
          id = encodeBase4(counter, 4);
        }
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
          Location: original,
          ...corsHeaders
        }
      });
    }

    return new Response("URL Shortener Running", {
      headers: corsHeaders
    });
  }
};