import styles from "./Fantasmita.module.css";

export default function Fantasmita({
  size = 120,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`${styles.wrap} ${className}`}
      style={{ "--fantasmita-size": `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <div className={styles.fantasmita}>
        <div className={styles.cuerpo}>
          <div className={styles.cara}>
            <div className={`${styles.ojo} ${styles.ojoIzq}`} />
            <div className={`${styles.ojo} ${styles.ojoDer}`} />
            <div className={styles.boca} />
          </div>
          <div className={styles.ondas}>
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className={styles.sombra} />
      </div>
    </div>
  );
}
