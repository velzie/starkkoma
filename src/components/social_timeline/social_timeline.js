import Timeline from '../timeline/timeline.vue'
const SocialTimeline = {
  components: {
    Timeline
  },
  computed: {
    timeline () { return this.$store.state.statuses.timelines.bubble }
  },
  created () {
    this.$store.dispatch('startFetchingTimeline', { timeline: 'social' })
  },
  unmounted () {
    this.$store.dispatch('stopFetchingTimeline', 'bubble')
  }

}

export default SocialTimeline
