"use client";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import Link from "next/link";

function Row1() {
  return <div style={box}>Row 1 - Status</div>;
}

function Row2() {
  return <div style={box}>Row 2 - Asset & Performance</div>;
}

function Row3() {
  return <div style={box}>Row 3 - Behavior</div>;
}

function Row4() {
  return <div style={box}>Row 4 - Overtrade</div>;
}

function Row5() {
  return <div style={box}>Row 5 - Goals</div>;
}

export default function DashboardPage() {
  const { appearance } = useAppearance();

  const order =
    appearance.dashboardRowOrder ?? ["row1", "row2", "row3", "row4", "row5"];

  function renderRow(id: string) {
    switch (id) {
      case "row1":
        return appearance.showRow1Status ? <Row1 key="row1" /> : null;
      case "row2":
        return appearance.showRow2AssetPerf ? <Row2 key="row2" /> : null;
      case "row3":
        return appearance.showRow3Behavior ? <Row3 key="row3" /> : null;
      case "row4":
        return appearance.showRow4Overtrade ? <Row4 key="row4" /> : null;
      case "row5":
        return appearance.showRow5Goals ? <Row5 key="row5" /> : null;
      default:
        return null;
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <div style={{ marginBottom: 16 }}>
        <Link href="/settings">Settings</Link>
      </div>

      {order.map((id) => renderRow(id))}
    </div>
  );
}

const box: React.CSSProperties = {
  padding: 20,
  marginBottom: 12,
  background: "white",
  border: "1px solid #eee",
  borderRadius: 8,
};
