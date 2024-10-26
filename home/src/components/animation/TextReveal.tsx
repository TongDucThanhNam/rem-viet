export const TextReveal = ({
  text,
  myclass,
}: {
  text: string;
  myclass: string;
}) => {
  return (
    <>
      {text.match(/./gu)!.map((char, index) => (
        <p
          key={`${char}-${index}`}
          className={`animate-text-reveal inline-block [animation-fill-mode:backwards] ${myclass}`}
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          {char === " " ? "\u00A0" : char}
        </p>
      ))}
    </>
  );
};
