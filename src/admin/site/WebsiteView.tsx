import { useState } from "react"
import { Archive, Check, FileText, Globe, ImagePlus, Megaphone, Rocket, Search, ShoppingBag } from "lucide-react"
import { SectionTitle } from "../../components/kit"
import HomepagePanel from "./HomepagePanel"
import PagesPanel from "./PagesPanel"
import SeoPanel from "./SeoPanel"
import AssetsPanel from "./AssetsPanel"
import FeaturesPanel from "./FeaturesPanel"
import ReleasesPanel from "./ReleasesPanel"
import DownloadsPanel from "./DownloadsPanel"
import ProductsPanel from "./ProductsPanel"
import AnnouncementsPanel from "./AnnouncementsPanel"

type Tab = "home" | "pages" | "seo" | "assets" | "features" | "releases" | "downloads" | "products" | "announcements"
const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "home", label: "الرئيسية", icon: Globe },
  { id: "pages", label: "صفحات الموقع", icon: FileText },
  { id: "seo", label: "SEO والفهرسة", icon: Search },
  { id: "assets", label: "الصور والملفات", icon: ImagePlus },
  { id: "features", label: "الميزات", icon: Check },
  { id: "releases", label: "الإصدارات", icon: Rocket },
  { id: "downloads", label: "التنزيلات", icon: Archive },
  { id: "products", label: "المنتجات والأسعار", icon: ShoppingBag },
  { id: "announcements", label: "الإعلانات العامة", icon: Megaphone },
]

export default function WebsiteView() {
  const [tab, setTab] = useState<Tab>("home")
  return <div className="mz-view space-y-5">
    <SectionTitle title="إدارة الموقع" sub="تحرير المحتوى متعدد اللغات، SEO، الصور، الميزات والتنزيلات. المحتوى المنشور يُعرض على الموقع العام؛ نسخ SSG تحتاج إعادة بناء الموقع لتنعكس في ملفات HTML والفهرس." />
    <nav aria-label="أقسام إدارة الموقع" className="flex gap-2 overflow-x-auto rounded-xl border border-line bg-surface p-2">
      {TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${tab === id ? "bg-brand text-white" : "text-muted hover:bg-canvas"}`}><Icon className="h-4 w-4" />{label}</button>)}
    </nav>
    {tab === "home" && <HomepagePanel />}
    {tab === "pages" && <PagesPanel />}
    {tab === "seo" && <SeoPanel />}
    {tab === "assets" && <AssetsPanel />}
    {tab === "features" && <FeaturesPanel />}
    {tab === "releases" && <ReleasesPanel />}
    {tab === "downloads" && <DownloadsPanel />}
    {tab === "products" && <ProductsPanel />}
    {tab === "announcements" && <AnnouncementsPanel />}
  </div>
}
