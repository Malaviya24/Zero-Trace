import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Plus, Users, Hash, Shield } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const rooms = useQuery(api.rooms.list) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">Zero Trace</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/setup">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/avatars/01.png" alt="@shadcn" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container px-4 md:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your secure communications and connect with the network.
              </p>
            </div>
            <Button size="lg" className="gap-2 shadow-lg shadow-primary/20" onClick={() => navigate("/create")}>
              <Plus className="h-5 w-5" />
              New Encrypted Room
            </Button>
          </div>
        </section>

        {/* Quick Stats / Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rooms?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Currently live on the network
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Rooms Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Active Rooms</h2>
            <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => navigate("/join")}>
              Join by ID &rarr;
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms?.map((room) => (
              <motion.div
                key={room._id}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/room/${room.roomId}`)}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{room.name || "Untitled Room"}</span>
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {room.roomId}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Created by {room.creatorId ? "User" : "Anonymous"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{room.maxParticipants} max</span>
                      </div>
                      {room.settings?.selfDestruct && (
                        <div className="flex items-center gap-1 text-destructive">
                          <Shield className="h-4 w-4" />
                          <span>Self-destruct</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            
            {/* Empty State */}
            {rooms?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/10">
                <Hash className="h-12 w-12 mb-4 opacity-20" />
                <p>No active rooms found.</p>
                <Button variant="link" onClick={() => navigate("/create")}>Create one now</Button>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
