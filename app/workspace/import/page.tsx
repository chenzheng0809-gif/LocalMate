import Link from "next/link";
import { ProductQuickStart } from "@/components/landing/ProductQuickStart";
import { LocalMateShell } from "@/components/localmate/Shell";

export const dynamic = "force-dynamic";

export default function ProductImportPage() {
  return <LocalMateShell active="products">
    <div className="lm-heading"><h1>导入商品</h1><Link href="/workspace?view=products" className="lm-link">返回商品档案</Link></div>
    <ProductQuickStart />
  </LocalMateShell>;
}
