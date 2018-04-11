import {Component} from 'react'
import PropTypes from 'prop-types'
import {flatten, sortedUniqBy, sortBy} from 'lodash'
import {loadPreferences, savePreferences} from './preferences'
import fetchDestinations from './fetch-destinations'
import {getNewDestinations, mergePreferences} from './utils'
import loadAnalytics from './analytics'

export default class ConsentManagerBuilder extends Component {
  static displayName = 'ConsentManagerBuilder'

  static propTypes = {
    children: PropTypes.func.isRequired,
    writeKey: PropTypes.string.isRequired,
    otherWriteKeys: PropTypes.arrayOf(PropTypes.string),
    shouldEnforceConsent: PropTypes.func,
  }

  static defaultProps = {
    otherWriteKeys: [],
    shouldEnforceConsent: () => true,
  }

  constructor() {
    super()

    this.state = {
      isLoading: true,
      destinations: [],
      newDestinations: [],
      preferences: {},
    }
  }

  render() {
    const {children} = this.props
    const {isLoading, destinations, preferences, newDestinations} = this.state

    if (isLoading) {
      return null
    }

    return children({
      destinations,
      newDestinations,
      preferences,
      setPreferences: this.handleSetPreferences,
      resetPreferences: this.handleResetPreferences,
      saveConsent: this.handleSaveConsent,
    })
  }

  componentDidMount() {
    // TODO: handle errors properly
    this.initialise()
  }

  initialise = async () => {
    const {writeKey, otherWriteKeys, shouldEnforceConsent} = this.props
    const preferences = loadPreferences()

    if (!await shouldEnforceConsent()) {
      return
    }

    const destinationsRequests = [fetchDestinations(writeKey)]
    for (const otherWriteKey of otherWriteKeys) {
      destinationsRequests.push(fetchDestinations(otherWriteKey))
    }

    let destinations = flatten(await Promise.all(destinationsRequests))

    destinations = sortBy(destinations, ['id'])
    destinations = sortedUniqBy(destinations, 'id')

    loadAnalytics({writeKey, destinations, preferences})

    const newDestinations = getNewDestinations(destinations, preferences)

    this.setState({
      isLoading: false,
      destinations,
      newDestinations,
      preferences,
    })
  }

  handleSetPreferences = newPreferences => {
    this.setState(prevState => {
      const {destinations, preferences: existingPreferences} = prevState
      return {
        preferences: mergePreferences({
          destinations,
          existingPreferences,
          newPreferences,
        }),
      }
    })
  }

  handleResetPreferences = () => {
    this.setState({preferences: loadPreferences()})
  }

  handleSaveConsent = newPreferences => {
    const {writeKey} = this.props
    const {destinations, preferences: existingPreferences} = this.state
    const preferences = mergePreferences({
      destinations,
      existingPreferences,
      newPreferences,
    })

    const newDestinations = getNewDestinations(destinations, preferences)

    savePreferences(preferences)
    this.setState({preferences, newDestinations})

    loadAnalytics({writeKey, destinations, preferences})
  }
}
