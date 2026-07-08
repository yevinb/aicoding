import { NextRequest, NextResponse } from "next/server";
import { createLead, getLeads } from "@/lib/store";

export async function GET() {
  const leads = await getLeads();
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.contactName || !body.company) {
    return NextResponse.json(
      { error: "contactName and company are required" },
      { status: 400 }
    );
  }
  const lead = await createLead(body);
  return NextResponse.json(lead, { status: 201 });
}
