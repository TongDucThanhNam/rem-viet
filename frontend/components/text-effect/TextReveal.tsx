export const TextReveal = ({
  text,
  myclass,
}: {
  text: string;
  myclass: string;
}) => {
  return (
    <>
      <h1 className={`text-2xl font-bold ${myclass}`}>
        {text.match(/./gu)!.map((char, index) => (
          <p
            className="animate-text-reveal inline-block [animation-fill-mode:backwards]"
            key={`${char}-${index}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {char === " " ? "\u00A0" : char}
          </p>
        ))}
      </h1>
    </>
  );
};
