export default function GamePage() {
  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1 style={{ color: "gold", fontSize: "2rem" }}>🎮 משחק MLEO</h1>
      <iframe
        src="/mleo-game.html"
        width="100%"
        height="600"
        style={{
          border: "none",
          maxWidth: "900px",
          borderRadius: "12px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
        }}
      ></iframe>
    </div>
  );
}
