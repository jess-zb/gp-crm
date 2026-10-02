import { task } from "@trigger.dev/sdk/v3";

export const diagnoseBug = task({
  id: "diagnose-bug",
  run: async (payload: {
    issueId: string;
    title: string;
    errorMessage: string;
    stackTrace: string;
    url: string;
  }) => {
    // Step 1 — Get Claude's diagnosis
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are a senior Next.js developer reviewing a bug in a CRM app called Zero Balance CRM. It uses Next.js, Supabase, and Vercel.

A new error was captured by Sentry:

Title: ${payload.title}
Error: ${payload.errorMessage}
Stack Trace: ${payload.stackTrace}
URL: ${payload.url}

Provide a concise diagnosis:
1. Root cause (2-3 sentences max)
2. File and line to look at first
3. Exact fix to apply
4. Any side effects to watch for

Be specific and actionable. Format for a developer who needs to fix this fast.`
          }
        ]
      })
    });

    const data = await response.json();
    const diagnosis = data.content[0].text;

    console.log("Diagnosis complete:", diagnosis.slice(0, 100));

    // Step 2 — Find the Linear ticket and post the diagnosis
    if (process.env.LINEAR_API_KEY) {
      // Search for the Linear issue by Sentry issue ID in the title
      const searchResponse = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": process.env.LINEAR_API_KEY,
        },
        body: JSON.stringify({
          query: `
            query {
              issues(filter: { title: { containsIgnoreCase: "${payload.title.slice(0, 50).replace(/"/g, '')}" } }, first: 1) {
                nodes {
                  id
                  title
                }
              }
            }
          `
        })
      });

      const searchData = await searchResponse.json();
      const linearIssue = searchData.data?.issues?.nodes?.[0];

      if (linearIssue) {
        // Post diagnosis as a comment
        await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": process.env.LINEAR_API_KEY,
          },
          body: JSON.stringify({
            query: `
              mutation {
                commentCreate(input: {
                  issueId: "${linearIssue.id}",
                  body: "## 🤖 Claude Auto-Diagnosis\n\n${diagnosis.replace(/"/g, '\\"').replace(/\n/g, '\\n')}\n\n---\n*Sentry Issue: ${payload.url}*"
                }) {
                  success
                }
              }
            `
          })
        });
        console.log("Posted diagnosis to Linear issue:", linearIssue.id);
      }
    }

    return { diagnosis, issueId: payload.issueId };
  }
});