import Status from '../status/status.vue'
import timelineFetcher from '../../services/timeline_fetcher/timeline_fetcher.service.js'
import Conversation from '../conversation/conversation.vue'
import TimelineMenu from '../timeline_menu/timeline_menu.vue'
import TimelineMenuTabs from '../timeline_menu_tabs/timeline_menu_tabs.vue'
import TimelineQuickSettings from './timeline_quick_settings.vue'
import { debounce, throttle, keyBy } from 'lodash'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCircleNotch, faCog, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons'

library.add(
  faCircleNotch,
  faCog,
  faPlus,
  faMinus
)

const Timeline = {
  props: [
    'timeline',
    'timelineName',
    'title',
    'userId',
    'listId',
    'tag',
    'embedded',
    'count',
    'pinnedStatusIds',
    'inProfile',
    'footerSlipgate' // reference to an element where we should put our footer
  ],
  data () {
    return {
      paused: false,
      unfocused: false,
      bottomedOut: false,
      virtualScrollIndex: 0,
      blockingClicks: false
    }
  },
  components: {
    Status,
    Conversation,
    TimelineMenu,
    TimelineMenuTabs,
    TimelineQuickSettings
  },
  computed: {
    filteredVisibleStatuses () {
      return this.timeline.visibleStatuses.filter(status => this.timelineName !== 'user' || (status.id >= this.timeline.minId && status.id <= this.timeline.maxId))
    },
    filteredPinnedStatusIds () {
      return (this.pinnedStatusIds || []).filter(statusId => this.timeline.statusesObject[statusId])
    },
    newStatusCount () {
      return this.timeline.newStatusCount
    },
    showLoadButton () {
      return this.timeline.newStatusCount > 0 || this.timeline.flushMarker !== 0
    },
    loadButtonString () {
      if (this.timeline.flushMarker !== 0) {
        return this.$t('timeline.reload')
      } else {
        return `${this.$t('timeline.show_new')} (${this.newStatusCount})`
      }
    },
    classes () {
      let rootClasses = !this.embedded ? ['panel', 'panel-default'] : ['-nonpanel']
      if (this.blockingClicks) rootClasses = rootClasses.concat(['-blocked', '_misclick-prevention'])
      return {
        root: rootClasses,
        header: ['timeline-heading'].concat(!this.embedded ? ['panel-heading', '-sticky'] : []),
        body: ['timeline-body'].concat(!this.embedded ? ['panel-body'] : []),
        footer: ['timeline-footer'].concat(!this.embedded ? ['panel-footer'] : [])
      }
    },
    // id map of statuses which need to be hidden in the main list due to pinning logic
    pinnedStatusIdsObject () {
      return keyBy(this.pinnedStatusIds)
    },
    statusesToDisplay () {
      const amount = this.timeline.visibleStatuses.length
      const statusesPerSide = Math.ceil(Math.max(3, window.innerHeight / 80))
      const nonPinnedIndex = this.virtualScrollIndex - this.filteredPinnedStatusIds.length
      const min = Math.max(0, nonPinnedIndex - statusesPerSide)
      const max = Math.min(amount, nonPinnedIndex + statusesPerSide)
      return this.timeline.visibleStatuses.slice(min, max).map(_ => _.id)
    },
    virtualScrollingEnabled () {
      return this.$store.getters.mergedConfig.virtualScrolling
    },
    showPanelNavShortcuts () {
      return this.$store.getters.mergedConfig.showPanelNavShortcuts
    },
    currentUser () {
      return this.$store.state.users.currentUser
    },
    tagData () {
      return this.$store.state.tags.tags[this.tag]
    },
    tagFollowed () {
      return this.$store.state.tags.tags[this.tag]?.following
    }
  },
  created () {
    const store = this.$store
    const credentials = store.state.users.currentUser.credentials
    const showImmediately = this.timeline.visibleStatuses.length === 0

    window.addEventListener('scroll', this.handleScroll)

    if (store.state.api.fetchers[this.timelineName]) { return false }

    timelineFetcher.fetchAndUpdate({
      store,
      credentials,
      timeline: this.timelineName,
      showImmediately,
      userId: this.userId,
      listId: this.listId,
      tag: this.tag
    })
  },
  mounted () {
    if (typeof document.hidden !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange, false)
      this.unfocused = document.hidden
    }
    window.addEventListener('keydown', this.handleShortKey)
    setTimeout(this.determineVisibleStatuses, 250)

    if (this.tag) {
      this.$store.dispatch('getTag', this.tag)
    }
  },
  unmounted () {
    window.removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('keydown', this.handleShortKey)
    if (typeof document.hidden !== 'undefined') document.removeEventListener('visibilitychange', this.handleVisibilityChange, false)
    this.$store.commit('setLoading', { timeline: this.timelineName, value: false })
  },
  methods: {
    stopBlockingClicks: debounce( function()  {
      this.blockingClicks = false
    }, 1000),
    blockClicksTemporarily () {
      if (!this.blockingClicks) {
        this.blockingClicks = true
      }
      this.stopBlockingClicks()
    },
    handleShortKey (e) {
      // Ignore when input fields are focused
      if (['textarea', 'input'].includes(e.target.tagName.toLowerCase())) return
      if (e.key === '.') this.showNewStatuses()
    },
    showNewStatuses () {
      if (this.timeline.flushMarker !== 0) {
        this.$store.commit('clearTimeline', { timeline: this.timelineName, excludeUserId: true })
        this.$store.commit('queueFlush', { timeline: this.timelineName, id: 0 })
        this.fetchOlderStatuses()
      } else {
        this.blockClicksTemporarily()
        this.$store.commit('showNewStatuses', { timeline: this.timelineName })
        this.paused = false
      }
      if (!this.inProfile) {
        window.scrollTo({ top: 0 })
      }
    },
    fetchOlderStatuses: throttle( function () {
      const store = this.$store
      const credentials = store.state.users.currentUser.credentials
      //store.commit('setLoading', { timeline: this.timelineName, value: true })
      timelineFetcher.fetchAndUpdate({
        store,
        credentials,
        timeline: this.timelineName,
        older: true,
        showImmediately: true,
        userId: this.userId,
        listId: this.listId,
        tag: this.tag
      }).then(({ statuses }) => {
        if (statuses && statuses.length === 0) {
          this.bottomedOut = true
        }
      }).finally(() =>
        store.commit('setLoading', { timeline: this.timelineName, value: false })
      )
    }, 1000, this),
    determineVisibleStatuses () {
      if (!this.$refs.timeline) return
      if (!this.virtualScrollingEnabled) return

      const statuses = this.$refs.timeline.children
      const cappedScrollIndex = Math.max(0, Math.min(this.virtualScrollIndex, statuses.length - 1))

      if (statuses.length === 0) return

      const height = Math.max(document.body.offsetHeight, window.pageYOffset)

      const centerOfScreen = window.pageYOffset + (window.innerHeight * 0.5)

      // Start from approximating the index of some visible status by using
      // the center of the screen on the timeline.
      let approxIndex = Math.floor(statuses.length * (centerOfScreen / height))
      let err = statuses[approxIndex].getBoundingClientRect().y

      // if we have a previous scroll index that can be used, test if it's
      // closer than the previous approximation, use it if so

      const virtualScrollIndexY = statuses[cappedScrollIndex].getBoundingClientRect().y
      if (Math.abs(err) > virtualScrollIndexY) {
        approxIndex = cappedScrollIndex
        err = virtualScrollIndexY
      }

      // if the status is too far from viewport, check the next/previous ones if
      // they happen to be better
      while (err < -20 && approxIndex < statuses.length - 1) {
        err += statuses[approxIndex].offsetHeight
        approxIndex++
      }
      while (err > window.innerHeight + 100 && approxIndex > 0) {
        approxIndex--
        err -= statuses[approxIndex].offsetHeight
      }

      // this status is now the center point for virtual scrolling and visible
      // statuses will be nearby statuses before and after it
      this.virtualScrollIndex = approxIndex
    },
    scrollLoad (e) {
      const bodyBRect = document.body.getBoundingClientRect()
      const height = Math.max(bodyBRect.height, -(bodyBRect.y))
      if (this.timeline.loading === false &&
          this.$el.offsetHeight > 0 &&
          (window.innerHeight + window.pageYOffset) >= (height - 750)) {
        this.fetchOlderStatuses()
      }
    },
    handleScroll: throttle( function (e)  {
      this.determineVisibleStatuses()
      this.scrollLoad(e)
    }, 200),
    handleVisibilityChange () {
      this.unfocused = document.hidden
    },
    followTag (tag) {
      return this.$store.dispatch('followTag', tag)
    },
    unfollowTag (tag) {
      return this.$store.dispatch('unfollowTag', tag)
    }
  },
  watch: {
    newStatusCount (count) {
      if (!this.$store.getters.mergedConfig.streaming) {
        return
      }
      if (count > 0) {
        // only 'stream' them when you're scrolled to the top
        const doc = document.documentElement
        const top = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)
        if (top < 15 &&
            !this.paused &&
            !(this.unfocused && this.$store.getters.mergedConfig.pauseOnUnfocused)
        ) {
          this.showNewStatuses()
        } else {
          this.paused = true
        }
      }
    }
  }
}

export default Timeline
