# How the Role-Aware AI Agent Works

The AI ChatWidget in this application is not just a standard chatbot; it is a **Role-Aware Agentic System** built with the Vercel AI SDK and Groq (currently running `qwen/qwen3.8-27b`). It dynamically adapts its behavior, personality, and capabilities based on who is logged in.

Here is the exact step-by-step logic executing in `app/api/chat/route.ts`:

### 1. Authentication & Role Detection
When you type a message in the chat widget on the frontend, the request is sent to the Next.js API route (`/api/chat`). The very first thing the code does is securely decrypt your HTTP-only `session` cookie.
* **If you aren't logged in**, it defaults you to a `"GUEST"` role.
* **If you are logged in**, it extracts your exact role (e.g., `"CUSTOMER"`, `"MANAGER"`, `"ADMIN"`).

### 2. Dynamic System Prompting
Based on your detected role, the API constructs a dynamic "System Prompt". This is a set of hidden instructions that tells the AI how to behave before it even sees your message:
* **Customers & Guests:** The prompt tells the AI to act as a *polite hotel concierge*.
* **Managers & Admins:** The prompt transforms the AI into a *high-level hotel operations assistant* focused on data and analytics.

### 3. Agentic Tool Injection (Function Calling)
This is where the "Agent" part comes in. We inject specific Javascript functions (Tools) directly into the AI's "brain" based on your role:
* **Customers** are granted the `checkAvailability` tool and the `getMyBookings` tool.
* **Managers** are granted the `getOccupancyReport` and `getRevenueReport` tools.

*(For example, a Customer literally cannot ask the AI for revenue data because the AI is never granted the `getRevenueReport` tool when a Customer is logged in!)*

### 4. The Reasoning Loop (`maxSteps: 3`)
When a Manager asks a question like *"How much revenue did we make this month?"*:
1. The AI receives the text.
2. It realizes it cannot answer this from its training data.
3. It halts text generation and executes a **Tool Call** requesting to trigger `getRevenueReport(startDate, endDate)`.
4. Our Next.js backend intercepts this tool call and executes the `ReportsService.getRevenue()` Prisma query against your PostgreSQL database.
5. The raw JSON database response is fed *back* to the AI.
6. The AI finally generates a natural language response summarizing the revenue data for you.

### 5. Blazing-Fast Streaming
Instead of waiting for this entire loop to finish, the Vercel AI SDK streams the output back to the frontend chunk-by-chunk using `toTextStreamResponse()`. Because we've now switched the engine to **Groq's Qwen 3.8 27B model**, this entire database reasoning loop executes in milliseconds.
