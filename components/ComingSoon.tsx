export default function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <main className="stub wrap">
      <h1>{title}</h1>
      <p className="lede">{text}</p>
    </main>
  );
}
