// @ts-nocheck
import { useEffect, useState, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreatePost } from '@/components/post/CreatePost';
import { PostCard } from '@/components/post/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, RefreshCw, Clock, Shuffle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavbarVisible } from '@/hooks/use-navbar-visible';

type FilterType = 'random' | 'newest' | 'all';

const Index = () => {
  const { user } = useAuth();
  const navVisible = useNavbarVisible();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('random');

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch public posts
      const { data: publicData, error: publicError } = await supabase
        .from('posts')
        .select('*')
        .in('visibility', ['public'])
        .order('created_at', { ascending: false });

      if (publicError) throw publicError;

      let friendsPosts: any[] = [];

      // If logged in, fetch friends posts
      if (user) {
        // Get friend IDs
        const { data: friendships } = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .eq('status', 'accepted')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

        const friendIds = (friendships || []).map(f =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        );

        if (friendIds.length > 0) {
          const { data: fData } = await supabase
            .from('posts')
            .select('*')
            .eq('visibility', 'friends')
            .in('user_id', friendIds)
            .order('created_at', { ascending: false });
          friendsPosts = fData || [];
        }

        // Also get own friends-only posts
        const { data: ownFriendsPosts } = await supabase
          .from('posts')
          .select('*')
          .eq('visibility', 'friends')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        friendsPosts = [...friendsPosts, ...(ownFriendsPosts || [])];
      }

      const allPosts = [...(publicData || []), ...friendsPosts];
      // Deduplicate
      const seen = new Set<string>();
      const uniquePosts = allPosts.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      // Fetch profiles
      const userIds = [...new Set(uniquePosts.map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('*')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      const postsWithProfiles = uniquePosts
        .filter(post => {
          const profile = profilesMap.get(post.user_id);
          return profile && !profile.is_banned;
        })
        .map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id)
        }));

      setPosts(postsWithProfiles as Post[]);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const displayedPosts = useMemo(() => {
    switch (filter) {
      case 'random':
        return shuffleArray(posts);
      case 'newest':
        return [...posts].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'all':
      default:
        return posts;
    }
  }, [posts, filter]);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bảng tin</h1>
            <p className="text-sm text-muted-foreground">Khám phá những gì mới</p>
          </div>
        </div>

        {/* Sticky Filter Bar */}
        <div className={`sticky ${navVisible ? 'top-16' : 'top-0'} z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm -mx-4 px-4 py-3 transition-[top] duration-300`}>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="flex-1">
              <TabsList className="w-full glass rounded-xl p-1">
                <TabsTrigger value="random" className="flex-1 rounded-lg gap-2">
                  <Shuffle className="w-4 h-4" />
                  Ngẫu nhiên
                </TabsTrigger>
                <TabsTrigger value="newest" className="flex-1 rounded-lg gap-2">
                  <Clock className="w-4 h-4" />
                  Mới nhất
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1 rounded-lg gap-2">
                  <List className="w-4 h-4" />
                  Tất cả
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                fetchPosts();
                if (filter === 'random') setFilter('random');
              }}
              className="rounded-xl h-10 w-10 flex-shrink-0"
              title="Làm mới"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <CreatePost onPostCreated={fetchPosts} />

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-2xl p-5 animate-shimmer">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-3/4 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedPosts.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chưa có bài viết nào</h3>
              <p className="text-muted-foreground">Hãy là người đầu tiên chia sẻ điều gì đó!</p>
            </div>
          ) : (
            displayedPosts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={fetchPosts} />
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
