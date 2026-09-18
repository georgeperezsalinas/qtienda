"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Fantasmita.module.css";

type FantasmitaMode = "static" | "wander";

export default function Fantasmita({
  size = 120,
  className = "",
  mode = "static",
  visible = true,
}: {
  size?: number;
  className?: string;
  mode?: FantasmitaMode;
  visible?: boolean;
}) {
  const [pose, setPose] = useState({ x: 0, y: 0, rotate: 0 });

  useEffect(() => {
    if (mode !== "wander") return;

    function nextPose() {
      setPose({
        x: Math.round(Math.random() * 36 - 18),
        y: Math.round(Math.random() * 28 - 14),
        rotate: Math.round(Math.random() * 12 - 6),
      });
    }

    nextPose();
    const t = window.setInterval(nextPose, 2600 + Math.random() * 900);
    return () => window.clearInterval(t);
  }, [mode]);

  const style = useMemo(
    () =>
      ({
        "--fantasmita-size": `${size}px`,
        "--fantasmita-x": `${pose.x}px`,
        "--fantasmita-y": `${pose.y}px`,
        "--fantasmita-rotate": `${pose.rotate}deg`,
      }) as React.CSSProperties,
    [pose.rotate, pose.x, pose.y, size]
  );

  return (
    <div
      className={`${styles.wrap} ${mode === "wander" ? styles.wander : ""} ${visible ? styles.visible : styles.hidden} ${className}`}
      style={style}
      aria-hidden
    >
      <div className={styles.fantasmita}>
        <span className={`${styles.chispa} ${styles.chispaUno}`} />
        <span className={`${styles.chispa} ${styles.chispaDos}`} />
        <span className={`${styles.chispa} ${styles.chispaTres}`} />
        <div className={styles.cuerpo}>
          <div className={styles.brillo} />
          <div className={styles.brazoIzq} />
          <div className={styles.brazoDer} />
          <div className={styles.cara}>
            <div className={`${styles.ojo} ${styles.ojoIzq}`} />
            <div className={`${styles.ojo} ${styles.ojoDer}`} />
            <div className={`${styles.mejilla} ${styles.mejillaIzq}`} />
            <div className={`${styles.mejilla} ${styles.mejillaDer}`} />
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
