const BASE32 = "0123456789abcdefghijklmnopqrstuv";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// Base32 encoder
function encodeBase32(num, length) {
  let str = "";

  while (num > 0) {
    str = BASE32[num % 32] + str;
    num = Math.floor(num / 32);
  }

  str = str || "0";

  return str.padStart(length, "0");
}

// Extract first name from full_name parameter
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

        if (extracted) {
          // name + 2 base32 chars
          id = extracted + encodeBase32(counter, 2);
        } else {
          // digits only
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