export default function AsciiLogo() {
  return (
    <div className="relative">
      <pre className="font-mono text-[8px] sm:text-xs md:text-sm lg:text-base leading-none select-none text-primary-400 opacity-90" aria-label="Claude Cloud ASCII Logo">
      {`██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
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
 ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝`}
      </pre>
      <div className="absolute inset-0 bg-gradient-to-r from-primary-400/20 via-accent-400/20 to-primary-400/20 blur-xl" />
    </div>
  )
}