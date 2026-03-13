const BASE32 = "0123456789abcdefghijklmnopqrstuv";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function encodeBase32(num, length) {
  let str = "";

  while (num > 0) {
    str = BASE32[num % 32] + str;
    num = Math.floor(num / 32);
  }

  str = str || "0";

  return str.padStart(length, "0");
}

function extractNameFromURL(originalUrl) {
  try {
    const parsed = new URL(originalUrl);

    const fullName = parsed.searchParams.get("full_name");

    if (!fullName) return null;

    const firstName = fullName.trim().split(" ")[0];

    return firstName.slice(0, 8).toLowerCase();
  } catch {
    return null;
  }
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

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // SHORTEN
    if (request.method === "POST") {

      let data;

      try {
        data = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const original = data.url;
      const alias = data.alias;

      if (!original) {
        return json({ error: "Missing URL" }, 400);
      }

      try {
        new URL(original);
      } catch {
        return json({ error: "Invalid URL" }, 400);
      }

      let id;

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

        if (extracted) {
          id = extracted + encodeBase32(counter, 2);
        } else {
          id = encodeBase32(counter, 4);
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
        return new Response("Not Found", { status: 404 });
      }

      return Response.redirect(original, 302);
    }

    return new Response("URL Shortener API Running");
  }
};