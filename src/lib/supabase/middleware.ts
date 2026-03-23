import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with sessions being lost.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/register') &&
        !request.nextUrl.pathname.startsWith('/auth')
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from login/register
    if (
        user &&
        (request.nextUrl.pathname.startsWith('/login') ||
            request.nextUrl.pathname.startsWith('/register'))
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // Role-based route protection
    if (user) {
        const { data: profile } = await (supabase
            .from('profiles') as any)
            .select('role')
            .eq('id', user.id)
            .maybeSingle()

        const role = profile?.role
        const path = request.nextUrl.pathname

        if (role === 'viewer') {
            const isProtectedAction = 
                path.endsWith('/new') || 
                path.includes('/new/') ||
                (path.startsWith('/settings') && request.nextUrl.searchParams.get('tab') === 'users')

            if (isProtectedAction) {
                const url = request.nextUrl.clone()
                if (path.startsWith('/invoices')) url.pathname = '/invoices'
                else if (path.startsWith('/bills')) url.pathname = '/bills'
                else if (path.startsWith('/expenses')) url.pathname = '/expenses'
                else if (path.startsWith('/settings')) {
                    url.pathname = '/settings'
                    url.searchParams.set('tab', 'company')
                } else url.pathname = '/dashboard'
                
                return NextResponse.redirect(url)
            }
        }
    }

    return supabaseResponse
}
