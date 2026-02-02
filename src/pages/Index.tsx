import { useEffect, useState, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreatePost } from '@/components/post/CreatePost';
import { PostCard } from '@/components/post/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types/database';
import { Sparkles, RefreshCw, Clock, Shuffle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type FilterType = 'random' | 'newest' | 'all';

const Index = () => {
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
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately using public_profiles view
      const userIds = [...new Set((data || []).map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('*')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      // Filter out posts from banned users
      const postsWithProfiles = (data || [])
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
  }, []);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Bảng tin</h1>
              <p className="text-sm text-muted-foreground">Khám phá những gì mới</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchPosts();
              if (filter === 'random') {
                setFilter('random');
              }
            }}
            className="rounded-xl gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </Button>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
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

        {/* Create Post */}
        <CreatePost onPostCreated={fetchPosts} />

        {/* Posts Feed */}
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
              <p className="text-muted-foreground">
                Hãy là người đầu tiên chia sẻ điều gì đó!
              </p>
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
