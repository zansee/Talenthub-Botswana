import logo from "@/assets/talenthub-logo.png";

export const Logo = ({ size = 72, withText = false, className }: { size?: number; withText?: boolean; className?: string }) => (
  <div className={`flex flex-col items-center gap-1 ${className || ""}`}>
    <img
      src={logo}
      alt="TalentHub Botswana"
      style={{ height: size, width: "auto" }}
      className="object-contain"
    />
    {withText && (
      <p className="text-[10px] tracking-[0.3em] text-primary font-medium">CONNECTING TALENT</p>
    )}
  </div>
);
