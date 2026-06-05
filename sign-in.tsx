import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #FEC702 0%, #F97316 100%)",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
            CRM de Ventas
          </div>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
            Solarity Energía
          </div>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: { boxShadow: "0 20px 60px rgba(0,0,0,0.15)", borderRadius: "16px" },
              card: { borderRadius: "16px" },
            },
          }}
        />
      </div>
    </div>
  );
}
