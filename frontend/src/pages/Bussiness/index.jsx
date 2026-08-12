import React from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'

function IconCloud(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" /></svg>}
function IconWorkflow(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>}
function IconStorage(p) { return <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>}

export default function Business() {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Background Animated Blobs for Subtle Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[30rem] h-[30rem] bg-teal-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navbar (Minimal) */}
      <nav className="fixed w-full top-0 z-50 bg-white/40 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-800">NetFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Log in</Link>
            <Link to="/login" className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
            Supercharge Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500">
              Business Workflow
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto font-medium">
            The all-in-one platform for dynamic approvals, seamless document management, and scalable cloud storage. Built for modern teams.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login" className="px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-1 transition-all duration-300">
              Start Building Free
            </Link>
            <Link to="#features" className="px-8 py-3.5 text-base font-semibold text-slate-700 bg-white/60 backdrop-blur-md border border-white/40 rounded-full hover:bg-white/80 shadow-sm transition-all duration-300">
              Explore Features
            </Link>
          </div>
        </div>

        {/* Features Bento Grid */}
        <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Everything you need to scale</h2>
            <p className="text-slate-500 mt-2">Powerful tools packaged in a beautiful, minimalist interface.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            {/* Main Feature - DMS */}
            <div className="md:col-span-2 relative group overflow-hidden bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                    <IconCloud className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Intelligent DMS</h3>
                  <p className="mt-3 text-slate-600 max-w-md text-lg">
                    Manage all your organizational documents with our advanced Document Management System. Secure, searchable, and always synced.
                  </p>
                </div>
                {/* Abstract UI Representation */}
                <div className="absolute bottom-0 right-0 w-64 h-48 bg-white/80 backdrop-blur-md rounded-tl-2xl border-t border-l border-white/50 shadow-xl p-4 transform translate-y-8 translate-x-8 group-hover:-translate-y-4 group-hover:-translate-x-4 transition-transform duration-500">
                  <div className="w-full h-4 bg-slate-100 rounded-full mb-3"></div>
                  <div className="w-3/4 h-4 bg-slate-100 rounded-full mb-6"></div>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg"></div>
                    <div className="w-10 h-10 bg-purple-50 rounded-lg"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature - Workflows */}
            <div className="relative group overflow-hidden bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500">
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center mb-6">
                  <IconWorkflow className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Dynamic Workflows</h3>
                <p className="mt-3 text-slate-600 flex-1">
                  Automate approvals, routing, and notifications with an intuitive drag-and-drop workflow builder.
                </p>
              </div>
            </div>

            {/* Feature - S3 Storage */}
            <div className="relative group overflow-hidden bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500">
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                  <IconStorage className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">S3 Dedicated Storage</h3>
                <p className="mt-3 text-slate-600 flex-1">
                  Bring your own bucket. Integrate AWS, Cloudflare R2, or Azure directly into your tenant dashboard.
                </p>
              </div>
            </div>

            {/* Feature - Multi-Tenant */}
            <div className="md:col-span-2 relative group overflow-hidden bg-slate-900 rounded-3xl p-8 shadow-2xl transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 to-purple-600/20"></div>
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-3xl font-bold text-white mb-4">Enterprise Grade Multi-Tenancy</h3>
                  <p className="text-slate-300 max-w-xl text-lg">
                    Isolate data, configure custom domains, and manage hundreds of departments seamlessly from a central platform console.
                  </p>
                </div>
                <div className="mt-8 flex gap-4">
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium border border-white/10">SSO Ready</div>
                  <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium border border-white/10">Role Based Access</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">Starter</h3>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold text-slate-900">
                $49<span className="ml-1 text-xl font-medium text-slate-500">/mo</span>
              </div>
              <p className="mt-4 text-slate-600">Perfect for small teams starting their automation journey.</p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-center gap-3 text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Up to 50 users
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> 10 Active Workflows
                </li>
                <li className="flex items-center gap-3 text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Standard Support
                </li>
              </ul>
              <Link to="/login" className="mt-8 block w-full py-3 px-4 bg-indigo-50 text-indigo-700 font-semibold text-center rounded-xl hover:bg-indigo-100 transition">Get Started</Link>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 opacity-20 blur-2xl"></div>
              <h3 className="text-xl font-bold text-white">Enterprise</h3>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold text-white">
                $199<span className="ml-1 text-xl font-medium text-slate-400">/mo</span>
              </div>
              <p className="mt-4 text-slate-300">Advanced features for scaling organizations.</p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-center gap-3 text-slate-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Unlimited Users
                </li>
                <li className="flex items-center gap-3 text-slate-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Dedicated S3 Storage
                </li>
                <li className="flex items-center gap-3 text-slate-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Priority 24/7 Support
                </li>
              </ul>
              <Link to="/login" className="mt-8 block w-full py-3 px-4 bg-indigo-500 text-white font-semibold text-center rounded-xl hover:bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition">Contact Sales</Link>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white/40 backdrop-blur-md border-t border-white/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <span className="text-lg font-bold text-slate-900">NetFlow</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 NetFlow Inc. All rights reserved.</p>
        </div>
      </footer>
      
    </div>
  )
}
