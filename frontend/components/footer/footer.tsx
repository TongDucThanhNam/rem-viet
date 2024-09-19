import Link from "next/link";
import { Button } from "@nextui-org/react";
import {DialogCard} from "@/components/dialog/dialog-card";

export default function Footer() {
  return (
    <footer className="bg-muted text-muted-foreground">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">
              Địa chỉ của chúng tôi
            </h2>
            <div className="space-x-4">
              <DialogCard/>
            </div>
          </div>
          <div className="h-64 md:h-full min-h-[250px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.2112628799364!2d106.6384076!3d10.7951252!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3175297c20ce6ff3%3A0x671008ae50b4a394!2zTMaw4bubaSBjaOG7kW5nIG114buXaQ!5e0!3m2!1svi!2s!4v1726648582357!5m2!1svi!2s"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Maps"
            />
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-muted-foreground/20">
          <div className="flex flex-wrap justify-between items-center">
            <nav className="space-x-4 mb-4 md:mb-0">
              <Link href="#" className="hover:underline">
                Trang chủ
              </Link>
            </nav>
            <p className="text-sm">
              &copy; {new Date().getFullYear()} Rèm Việt.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
