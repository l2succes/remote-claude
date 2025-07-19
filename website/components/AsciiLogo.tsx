const logo = `
 ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗  
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
                                                  
 ██████╗██╗      ██████╗ ██╗   ██╗██████╗ 
██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗
██║     ██║     ██║   ██║██║   ██║██║  ██║
██║     ██║     ██║   ██║██║   ██║██║  ██║
╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝
 ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝`;

export default function AsciiLogo() {
  return (
    <div className="relative inline-block">
      <pre
        className="text-primary-400 opacity-90 select-none"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "clamp(0.5rem, 1.5vw, 1rem)",
          lineHeight: "1",
          letterSpacing: "0",
          whiteSpace: "pre",
          fontWeight: "bold",
        }}
        aria-label="Claude Cloud ASCII Logo"
      >
        {logo}
      </pre>
      <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 via-accent-400/10 to-primary-400/10 blur-2xl -z-10" />
    </div>
  );
}
