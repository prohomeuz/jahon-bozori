import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

const HomePage    = lazy(() => import('@/pages/home/ui/HomePage'))
const BlockPage   = lazy(() => import('@/pages/block/ui/BlockPage'))
const BolimPage   = lazy(() => import('@/pages/bolim/ui/BolimPage'))

function Loader() {
  return <div className="fixed inset-0 bg-black" />
}

export default function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/block/:id" element={<BlockPage />} />
          <Route path="/block/:blockId/bolim/:num" element={<BolimPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
