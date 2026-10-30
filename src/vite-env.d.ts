/// <reference types="vite/client" />

declare module "*.jsx" {
  import type { ComponentType } from "react";
  const component: ComponentType<{
    size?: number;
    autoBloom?: boolean;
    bloomWhenVisible?: boolean;
    replayToken?: number;
    reactToPointer?: boolean;
    showParticles?: boolean;
    decorative?: boolean;
    label?: string;
    className?: string;
    onBloomEnd?: () => void;
    onBurst?: () => void;
    gatherToken?: number;
    cover?: boolean;
  }>;
  export default component;
}
