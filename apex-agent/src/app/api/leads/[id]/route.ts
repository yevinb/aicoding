import { NextRequest, NextResponse } from "next/server";
import { deleteLead, getLead, updateLead } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const patch = await req.json();
  const lead = await updateLead(id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = await deleteLead(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
