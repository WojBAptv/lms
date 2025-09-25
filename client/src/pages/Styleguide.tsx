import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function Styleguide() {
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Styleguide</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">Buttons</h2>
        <div className="flex gap-2 flex-wrap">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>

          {/* Test Toast */}
          <Button onClick={() => toast("Hello! This is a test toast.")}>
            Test Toast
          </Button>
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-semibold mb-2">Inputs</h2>
        <div className="flex gap-3 items-center">
          <Input placeholder="Search…" className="w-80" />
          <Input type="date" className="w-52" />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="text-lg font-semibold mb-2">Tabs</h2>
        <Tabs defaultValue="one" className="w-[420px]">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Tab one</TabsContent>
          <TabsContent value="two">Tab two</TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
