import { NavLink } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Layers, ListChecks, CalendarCheck2, Users, Gauge } from "lucide-react";

const linkBase =
  "flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors";

const LinkItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `${linkBase} ${isActive ? "bg-black/10 dark:bg-white/10 font-medium" : ""}`
    }
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </NavLink>
);

export function AppNav() {
  return (
    <aside className="w-64 shrink-0 h-full border-r border-black/10 dark:border-white/10 p-3">
      <div className="text-sm font-semibold px-2 py-1 opacity-70">Planning</div>
      <div className="flex flex-col gap-1">
        <LinkItem to="/l1" icon={ListChecks} label="Project Activities" />
        <LinkItem to="/l2" icon={Layers} label="Programs & Projects" />
        <LinkItem to="/staff" icon={Users} label="Staff Assignment Plan" />
        <LinkItem to="/equipment" icon={CalendarCheck2} label="Equipment Reservations" />
        <LinkItem to="/capacity" icon={Gauge} label="Capacity Forecast" />
      </div>
      <Separator className="my-3" />
      <div className="text-sm font-semibold px-2 py-1 opacity-70">Dev</div>
      <div className="flex flex-col gap-1">
        <LinkItem to="/styleguide" icon={Layers} label="Styleguide" />
      </div>
    </aside>
  );
}
