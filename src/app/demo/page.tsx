import DemoScreen from "@/components/DemoScreen";
import {Suspense} from "react";
export default function DemoPage(){return <Suspense fallback={<p className="p-8 text-muted">Opening the notebook…</p>}><DemoScreen/></Suspense>;}
