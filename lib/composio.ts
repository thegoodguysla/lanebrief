import { Composio } from "composio-core";

let _client: Composio | null = null;

export function getComposio(): Composio {
  if (!_client) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error("COMPOSIO_API_KEY env var not set");
    _client = new Composio({ apiKey });
  }
  return _client;
}

// Each LaneBrief user maps to a Composio entity by their userId
export async function getEntity(userId: string) {
  const client = getComposio();
  return client.getEntity(userId);
}

// Get a redirect URL for a user to connect a tool (Slack, Google Sheets, HubSpot, etc.)
export async function getConnectionUrl(
  userId: string,
  toolName: string,
  redirectUri: string
): Promise<string> {
  const entity = await getEntity(userId);
  const connection = await entity.initiateConnection({
    appName: toolName,
    redirectUri,
  });
  return connection.redirectUrl;
}

// List active connections for a user
export async function listConnections(
  userId: string
): Promise<{ tool: string; status: string; connectedAt?: string }[]> {
  const entity = await getEntity(userId);
  const connections = await entity.getConnections();
  return connections.map((c) => ({
    tool: c.appName ?? c.appUniqueId ?? "unknown",
    status: c.status ?? "unknown",
    connectedAt: c.createdAt,
  }));
}

// Check if a specific tool is connected for a user
export async function isConnected(userId: string, toolName: string): Promise<boolean> {
  try {
    const connections = await listConnections(userId);
    return connections.some(
      (c) => c.tool.toLowerCase() === toolName.toLowerCase() && c.status === "ACTIVE"
    );
  } catch {
    return false;
  }
}

// Post a Slack message to the user's connected workspace
export async function postSlackAlert(
  userId: string,
  params: {
    origin: string;
    destination: string;
    newRate: number;
    deltaPct: number;
    insight: string;
  }
): Promise<void> {
  const { origin, destination, newRate, deltaPct, insight } = params;
  const dir = deltaPct >= 0 ? "▲" : "▼";
  const absDelta = Math.abs(deltaPct).toFixed(1);
  const text = `*LaneBrief Rate Alert* — ${origin} → ${destination}\n${dir} ${absDelta}% | $${newRate.toFixed(2)}/mi\n_${insight}_\n<https://lanebrief.com/dashboard|View full brief>`;

  const entity = await getEntity(userId);
  await entity.execute({
    actionName: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
    params: { message: text, channel: "#general" },
  });
}

// Append a row to the user's connected Google Sheet
export async function appendSheetsRow(
  userId: string,
  params: {
    origin: string;
    destination: string;
    equipment: string;
    newRate: number;
    deltaPct: number;
  }
): Promise<void> {
  const { origin, destination, equipment, newRate, deltaPct } = params;
  const entity = await getEntity(userId);
  await entity.execute({
    actionName: "GOOGLESHEETS_BATCH_UPDATE",
    params: {
      sheetTitle: "LaneBrief Alerts",
      data: [[
        new Date().toISOString().split("T")[0],
        origin,
        destination,
        equipment,
        newRate.toFixed(2),
        `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`,
      ]],
    },
  });
}
