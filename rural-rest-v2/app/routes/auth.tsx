import { Header, Button, Input, Card } from "../components/ui-mockup";

export default function Auth() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto flex items-center justify-center py-20 px-4">
                <Card className="w-full max-w-md p-8 shadow-xl border-none">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
                        <p className="text-muted-foreground">Login to manage your rural adventures.</p>
                    </div>
                    <form className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Address</label>
                            <Input type="email" placeholder="name@example.com" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <Input type="password" placeholder="••••••••" />
                        </div>
                        <Button className="w-full h-12 text-lg mt-4">Login</Button>
                    </form>
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="h-12">Google</Button>
                        <Button variant="outline" className="h-12">Kakao</Button>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-8">
                        Don't have an account? <a href="#" className="text-primary font-medium hover:underline">Sign up</a>
                    </p>
                </Card>
            </main>
        </div>
    );
}
