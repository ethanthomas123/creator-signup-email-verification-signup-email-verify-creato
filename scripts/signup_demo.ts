const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";

const response = await fetch(`${origin}/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "chenhua@changba.com",
    password: "change-this-demo-password",
    name: "Reader",
    creatorId: "studio-notes",
    assetSlug: "lighting-presets",
    updateTopics: ["new-releases"],
  }),
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
